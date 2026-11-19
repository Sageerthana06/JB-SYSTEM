// backend/scripts/final_whatsapp_verification_order_276.js
const { prisma } = require('../src/prisma');
const https = require('https');

const EXPECTED_EMOJIS = [
  { name: 'SPARKLES', char: '✨', codepoints: 'U+2728' },
  { name: 'CHERRY_BLOSSOM', char: '🌸', codepoints: 'U+1F338' },
  { name: 'BOUQUET', char: '💐', codepoints: 'U+1F490' },
  { name: 'CLIPBOARD', char: '📋', codepoints: 'U+1F4CB' },
  { name: 'BOOKMARK', char: '🔖', codepoints: 'U+1F516' },
  { name: 'DRESS', char: '👗', codepoints: 'U+1F457' },
  { name: 'MONEY_BAG', char: '💰', codepoints: 'U+1F4B0' },
  { name: 'DOLLAR_BILL', char: '💵', codepoints: 'U+1F4B5' },
  { name: 'CREDIT_CARD', char: '💳', codepoints: 'U+1F4B3' },
  { name: 'CHECK', char: '✅', codepoints: 'U+2705' },
  { name: 'HEART', char: '💖', codepoints: 'U+1F496' },
  { name: 'OFFICE', char: '🏢', codepoints: 'U+1F3E2' },
  { name: 'ROBOT', char: '🤖', codepoints: 'U+1F916' }
];

// Exact frontend normalizePhoneForWhatsApp function from SalesERP.jsx
const normalizePhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  const raw = String(phone).replace(/\D/g, '');
  if (raw.startsWith('00')) return raw.slice(2);
  if (raw.startsWith('0')) return '94' + raw.slice(1);
  return raw;
};

// Exact frontend generateQuotationWhatsAppMessage function from SalesERP.jsx
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

const generateQuotationWhatsAppMessage = (order) => {
  if (!order) return '';
  const customerName = (order.customer?.name || order.customerName || 'Customer').trim();

  const isBella =
    order.branchId === 2 ||
    order.branch?.id === 2 ||
    (typeof order.branch?.name === 'string' && /bella/i.test(order.branch.name)) ||
    (typeof order.branchName === 'string' && /bella/i.test(order.branchName)) ||
    (typeof order.orderNumber === 'string' && /bella/i.test(order.orderNumber)) ||
    (typeof order.quotationNumber === 'string' && /bella/i.test(order.quotationNumber));

  const quotationNumber = order.quotationNumber ||
    (order.orderNumber
      ? (order.orderNumber.startsWith('QT-') ? order.orderNumber : order.orderNumber.replace(/^(JB|ORD|BELLA)-/i, 'QT-'))
      : (order.id ? `QT-${order.id}` : 'QT-0001'));

  let itemsBlock = '';
  if (Array.isArray(order.items) && order.items.length > 0) {
    itemsBlock = order.items
      .map((it) => {
        const name = it.itemName || it.dressType || it.name || 'Bespoke Garment';
        const qty = Number(it.quantity || 1);
        return `${EMOJIS.DRESS} Item: ${name} ${EMOJIS.TIMES} ${qty}`;
      })
      .join('\n');
  } else {
    const itemName = order.garmentDetails?.dressType || order.dressType || order.itemName || 'Bespoke Garment';
    const quantity = Number(order.garmentDetails?.quantity || order.quantity || 1);
    itemsBlock = `${EMOJIS.DRESS} Item: ${itemName} ${EMOJIS.TIMES} ${quantity}`;
  }

  const totalAmount = Number(
    order.totalAmount !== undefined && order.totalAmount !== null
      ? order.totalAmount
      : (order.agreedTotal !== undefined && order.agreedTotal !== null ? order.agreedTotal : 0)
  );

  const advanceAmount = Number(
    order.advancePayment !== undefined && order.advancePayment !== null
      ? order.advancePayment
      : (order.advanceRequired !== undefined && order.advanceRequired !== null
          ? order.advanceRequired
          : (order.agreedAdvance || 0))
  );

  const balanceAmount = Number(
    order.balanceAmount !== undefined && order.balanceAmount !== null
      ? order.balanceAmount
      : Math.max(0, totalAmount - advanceAmount)
  );

  const formatLKR = (num) => {
    const n = Number(num || 0);
    if (isNaN(n)) return '0';
    return n % 1 === 0
      ? n.toLocaleString('en-US')
      : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const companyHeader = isBella ? 'BELLA DESIGN' : 'JB GROUP (PVT) LTD';
  const brandShort = isBella ? 'BELLA DESIGN' : 'JB GROUP';

  return `${EMOJIS.SPARKLES} ${companyHeader} ${EMOJIS.SPARKLES}

Dear ${customerName}, ${EMOJIS.CHERRY_BLOSSOM}

Thank you for choosing ${brandShort}! ${EMOJIS.BOUQUET} We truly appreciate your trust in us.

${EMOJIS.CLIPBOARD} ORDER QUOTATION

${EMOJIS.BOOKMARK} Quotation No: ${quotationNumber}
${itemsBlock}
${EMOJIS.MONEY_BAG} Total Amount: LKR ${formatLKR(totalAmount)}
${EMOJIS.DOLLAR_BILL} Advance Payment: LKR ${formatLKR(advanceAmount)}
${EMOJIS.CREDIT_CARD} Balance Payable: LKR ${formatLKR(balanceAmount)}

${EMOJIS.CHECK} Kindly review and confirm your quotation so we can proceed with your order.

${EMOJIS.HEART} Your satisfaction is our priority, and we look forward to serving you!

${EMOJIS.OFFICE} ${companyHeader}
${EMOJIS.SPARKLES} Build ${EMOJIS.BULLET} Lead ${EMOJIS.BULLET} Inspire.

${EMOJIS.ROBOT} Automated message from ${brandShort} Management System.`;
};

async function verifyFinalOrder() {
  console.log('====================================================');
  console.log('🧪 FINAL LIVE ORDER VERIFICATION: JB-20261110-0007');
  console.log('====================================================');

  const order = await prisma.order.findUnique({
    where: { orderNumber: 'JB-20261110-0007' },
    include: { customer: true, garmentDetails: true, branch: true, payments: true }
  });

  if (!order) {
    console.error('❌ Could not find order JB-20261110-0007 in PostgreSQL database!');
    process.exit(1);
  }

  console.log('1. Database Record Loaded:');
  console.log(`   - Order ID: ${order.id}`);
  console.log(`   - Order Number: ${order.orderNumber}`);
  console.log(`   - Customer: ${order.customer?.name} (${order.customer?.primaryPhone})`);
  console.log(`   - Item: ${order.garmentDetails?.dressType} x ${order.garmentDetails?.quantity}`);
  console.log(`   - Total Amount: LKR ${order.totalAmount}`);

  console.log('\n2. Generated WhatsApp Message:');
  const message = generateQuotationWhatsAppMessage(order);
  console.log(message);

  const phone = normalizePhoneForWhatsApp(order.customer?.primaryPhone || order.customer?.phone);
  const targetUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;

  console.log('\n3. Real Button Click Action URL:');
  console.log(`   URL: ${targetUrl.substring(0, 150)}...`);

  console.log('\n4. Live HTTP Verification against api.whatsapp.com:');
  await new Promise((resolve, reject) => {
    https.get(targetUrl, (res) => {
      console.log(`   - HTTP Status: ${res.statusCode} ${res.statusMessage}`);
      if (res.statusCode !== 200) {
        console.error(`❌ Expected HTTP 200, got ${res.statusCode}`);
        return reject(new Error('Non-200 status'));
      }
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const linkMatch = body.match(/href="https:\/\/web\.whatsapp\.com\/send\/\?phone=[^"]+"/);
        if (!linkMatch) {
          console.error('❌ Could not find client launch URL in response HTML');
          return reject(new Error('No launch link'));
        }

        const launchUrl = linkMatch[0].replace(/&amp;/g, '&');
        const urlObj = new URL(launchUrl.replace('href="', '').replace('"', ''));
        const textInWhatsApp = urlObj.searchParams.get('text') || '';

        console.log('\n5. Decoded Message Delivered to WhatsApp Client Compose Box:');
        console.log(textInWhatsApp);

        console.log('\n6. Checking All 13 Emojis in Delivered WhatsApp Message:');
        const hasFFFD = textInWhatsApp.includes('\uFFFD') || textInWhatsApp.includes('%EF%BF%BD');
        console.log(`   - Contains U+FFFD (corrupted replacement character ): ${hasFFFD ? '❌ YES (CORRUPTED)' : '✅ NO (CLEAN)'}`);

        let allMatched = true;
        for (const em of EXPECTED_EMOJIS) {
          const present = textInWhatsApp.includes(em.char);
          console.log(`   ${present ? '✅' : '❌'} ${em.name} (${em.char} - ${em.codepoints}): ${present ? 'PRESENT' : 'MISSING'}`);
          if (!present) allMatched = false;
        }

        if (allMatched && !hasFFFD) {
          console.log('\n🎉 SUCCESS: All 13 emojis appear perfectly in WhatsApp without any U+FFFD replacement characters!');
          resolve();
        } else {
          console.error('\n❌ FAILED: Emojis were corrupted.');
          reject(new Error('Emoji verification failed'));
        }
      });
    }).on('error', reject);
  });
}

verifyFinalOrder().catch(console.error).finally(() => prisma.$disconnect());

