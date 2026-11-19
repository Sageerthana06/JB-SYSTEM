// backend/scripts/test_all_emojis_api_whatsapp.js
const https = require('https');

const expectedEmojis = [
  { name: 'SPARKLES', char: '✨', codepoint: 'U+2728' },
  { name: 'CHERRY_BLOSSOM', char: '🌸', codepoint: 'U+1F338' },
  { name: 'BOUQUET', char: '💐', codepoint: 'U+1F490' },
  { name: 'CLIPBOARD', char: '📋', codepoint: 'U+1F4CB' },
  { name: 'BOOKMARK', char: '🔖', codepoint: 'U+1F516' },
  { name: 'DRESS', char: '👗', codepoint: 'U+1F457' },
  { name: 'MONEY_BAG', char: '💰', codepoint: 'U+1F4B0' },
  { name: 'DOLLAR_BILL', char: '💵', codepoint: 'U+1F4B5' },
  { name: 'CREDIT_CARD', char: '💳', codepoint: 'U+1F4B3' },
  { name: 'CHECK', char: '✅', codepoint: 'U+2705' },
  { name: 'HEART', char: '💖', codepoint: 'U+1F496' },
  { name: 'OFFICE', char: '🏢', codepoint: 'U+1F3E2' },
  { name: 'ROBOT', char: '🤖', codepoint: 'U+1F916' }
];

const fullMessage = `✨ JB GROUP (PVT) LTD ✨

Dear Pumi, 🌸

Thank you for choosing JB GROUP! 💐 We truly appreciate your trust in us.

📋 ORDER QUOTATION

🔖 Quotation No: QT-20261110-0007
👗 Item: Saree Blouse × 1
💰 Total Amount: LKR 1,800
💵 Advance Payment: LKR 0
💳 Balance Payable: LKR 1,800

✅ Kindly review and confirm your quotation so we can proceed with your order.

💖 Your satisfaction is our priority, and we look forward to serving you!

🏢 JB GROUP (PVT) LTD
✨ Build • Lead • Inspire.

🤖 Automated message from JB GROUP Management System.`;

const text = encodeURIComponent(fullMessage);
const apiUrl = `https://api.whatsapp.com/send?phone=94763161236&text=${text}`;

https.get(apiUrl, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    
    // Check if the launch link in HTML preserves every emoji
    const launchLinkMatch = body.match(/href="https:\/\/web\.whatsapp\.com\/send\/\?phone=[^"]+"/);
    if (!launchLinkMatch) {
      console.log('Could not find web.whatsapp.com launch link in response.');
      return;
    }
    
    const launchUrl = launchLinkMatch[0].replace(/&amp;/g, '&');
    console.log('\nExtracted Launch URL:\n', launchUrl.substring(0, 300) + '...');
    
    // Check for U+FFFD (corrupted replacement character)
    const hasFFFD = launchUrl.includes('\uFFFD') || launchUrl.includes('%EF%BF%BD');
    console.log('\nContains U+FFFD (corrupted replacement char):', hasFFFD);
    
    console.log('\n--- Checking all 13 required emojis in target WhatsApp URL ---');
    let allPassed = true;
    for (const em of expectedEmojis) {
      const present = launchUrl.includes(em.char) || launchUrl.includes(encodeURIComponent(em.char));
      console.log(` ${present ? '✅' : '❌'} ${em.name} (${em.char} - ${em.codepoint}): ${present ? 'PRESERVED' : 'CORRUPTED'}`);
      if (!present) allPassed = false;
    }
    
    if (allPassed && !hasFFFD) {
      console.log('\n🎉 ALL 13 EMOJIS PERFECTLY PRESERVED IN WHATSAPP URL WITHOUT CORRUPTION!');
    } else {
      console.error('\n❌ Emojis corrupted!');
    }
  });
}).on('error', console.error);

