// backend/scripts/test_direct_whatsapp.js
const https = require('https');

const sampleMessage = '✨ JB GROUP (PVT) LTD ✨\n\nDear Pumi, 🌸\n\nThank you for choosing JB GROUP! 💐 We truly appreciate your trust in us.\n\n📋 ORDER QUOTATION\n\n🔖 Quotation No: QT-20261110-0007\n👗 Item: Saree Blouse × 1\n💰 Total Amount: LKR 1,800\n💵 Advance Payment: LKR 0\n💳 Balance Payable: LKR 1,800\n\n✅ Kindly review and confirm your quotation so we can proceed with your order.\n\n💖 Your satisfaction is our priority, and we look forward to serving you!\n\n🏢 JB GROUP (PVT) LTD\n✨ Build • Lead • Inspire.\n\n🤖 Automated message from JB GROUP Management System.';

const text = encodeURIComponent(sampleMessage);

// Test 1: wa.me
console.log('=== TEST 1: wa.me ===');
const waUrl = 'https://wa.me/94763161236?text=' + text;
https.get(waUrl, (res) => {
  console.log('wa.me status:', res.statusCode);
  const loc = res.headers.location || '';
  console.log('wa.me redirect location header:\n', loc);
  console.log('Redirect contains %EF%BF%BD (U+FFFD):', loc.includes('%EF%BF%BD'));
  
  // Test 2: api.whatsapp.com/send
  console.log('\n=== TEST 2: api.whatsapp.com/send ===');
  const apiUrl = 'https://api.whatsapp.com/send?phone=94763161236&text=' + text;
  https.get(apiUrl, (res2) => {
    console.log('api.whatsapp.com status:', res2.statusCode);
    let body = '';
    res2.on('data', chunk => body += chunk);
    res2.on('end', () => {
      console.log('api.whatsapp.com body length:', body.length);
      const hasFFFD = body.includes('\uFFFD') || body.includes('%EF%BF%BD');
      console.log('api.whatsapp.com contains U+FFFD (%EF%BF%BD):', hasFFFD);
      console.log('api.whatsapp.com contains sparkles (%E2%9C%A8):', body.includes('%E2%9C%A8') || body.includes('✨'));
      console.log('api.whatsapp.com contains dress (%F0%9F%45%7):', body.includes('%F0%9F%91%97') || body.includes('👗'));
      
      // Look for the action button href or preview in the HTML
      const matches = body.match(/href="([^"]*whatsapp:\/\/send[^"]*|[^"]*web\.whatsapp\.com[^"]*)"/g);
      if (matches) {
        console.log('\nFound client launch links in api.whatsapp.com HTML:');
        matches.forEach(m => console.log(' ->', decodeURIComponent(m.substring(0, 150))));
      }
    });
  });
}).on('error', console.error);

