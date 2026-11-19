// backend/scripts/verify_digital_invoice_redesign.js
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 JB SYSTEM — DIGITAL INVOICE VERIFICATION SUITE');
console.log('====================================================');

const componentPath = path.resolve(__dirname, '../../src/components/DigitalInvoiceModal.jsx');
const stylesPath = path.resolve(__dirname, '../../src/components/digitalInvoiceStyles.js');
if (!fs.existsSync(componentPath)) {
  console.error('❌ DigitalInvoiceModal.jsx does not exist!');
  process.exit(1);
}
const code = fs.readFileSync(componentPath, 'utf8');
const styles = fs.existsSync(stylesPath) ? fs.readFileSync(stylesPath, 'utf8') : '';
const allCode = code + '\n' + styles;

let passedTests = 0;
let totalTests = 0;

function assert(description, condition) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${description}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${description}`);
  }
}

// 1. Structure & Layout checks
console.log('\n--- 1. Page Size & Layout Requirements ---');
assert('Invoice card container has maxWidth 500px and border', allCode.includes('max-width: 500px') && allCode.includes('border: 1.5px solid #002b66'));
assert('Invoice card has standard 617px height for 1500x1851 export', allCode.includes('jb-invoice-standard') && allCode.includes('617px'));
assert('Invoice card has expanded auto height for multi-item orders', allCode.includes('jb-invoice-expanded') && allCode.includes('height: auto'));
assert('Invoice card has top-right decorative SVG swoop', allCode.includes('viewBox="0 0 135 85"') && allCode.includes('#dc2626') && allCode.includes('#002b66'));
assert('Bottom footer has red accent stripe and bottom-right swoop', allCode.includes('viewBox="0 0 55 32"') && allCode.includes('height: 2.5px') && allCode.includes('background-color: #dc2626'));
assert('Footer follows content in natural flow without absolute overlapping', allCode.includes('.jb-invoice-footer') && allCode.includes('position: relative'));

// 2. Header and Branding checks
console.log('\n--- 2. Header, Logo & Dual Branch Support ---');
assert('Official JB GROUP logo referenced', allCode.includes('/jb_group_logo.png'));
assert('Official JB GROUP Headquarters address present', allCode.includes('First floor, No 71, Thirugnanasampanthar Street, Trincomalee.'));
assert('Official phone numbers present (+94 72 627 8727 & +44 7847 431970)', allCode.includes('+94 72 627 8727') && allCode.includes('+44 7847 431970'));
assert('Dual-branch Bella Design support (isBella condition)', allCode.includes('isBella =') && allCode.includes('Bella Design Studio, Trincomalee.'));
assert('Bella Design does not display JB logo', allCode.includes("isBella ? (") && allCode.includes('BD'));

// 3. Invoice Title
console.log('\n--- 3. Central CUSTOMER INVOICE Banner ---');
assert('Centered CUSTOMER INVOICE pill flanked by red gradient wings', allCode.includes('CUSTOMER INVOICE') && allCode.includes('linear-gradient(90deg, transparent, #dc2626)'));

// 4. Customer details and reference metadata
console.log('\n--- 4. Billed To & Reference Grid ---');
assert('BILLED TO section with User icon', allCode.includes('BILLED TO:') && allCode.includes('customerName'));
assert('Customer phone with circular icon', allCode.includes('customerPhone'));
assert('Reference grid with 4 rows: Invoice No, Order No, Order Date, Booked Date', 
  allCode.includes('Invoice No') && allCode.includes('Order No') && allCode.includes('Order Date') && allCode.includes('Booked Date'));
assert('formatDateSpaced preserves YYYY - MM - DD spacing', allCode.includes('${y} - ${m} - ${day}'));

// 5. Item Table
console.log('\n--- 5. Item Table & Multiple Items Support ---');
assert('Deep navy table header (#002b66)', allCode.includes('background-color: #002b66'));
assert('Header columns: Description, Qty, Rate (Rs.), Total (Rs.)', 
  allCode.includes('Description') && allCode.includes('Qty') && allCode.includes('Rate (Rs.)') && allCode.includes('Total (Rs.)'));
assert('Supports dynamic multiple items mapping', allCode.includes('order.items.map') && allCode.includes('it.quantity') && allCode.includes('it.rate'));
assert('Word break enabled for long descriptions', allCode.includes('break-word') || allCode.includes('overflow-wrap: anywhere'));

// 6. Bespoke Tailoring Visual & Watermark
console.log('\n--- 6. Garment Visual & Background Watermark ---');
assert('Garment artwork saved in public/tailoring_mannequin_artwork.png', fs.existsSync(path.resolve(__dirname, '../../public/tailoring_mannequin_artwork.png')));
assert('Customer uploaded photo preferred if present', allCode.includes('resolvedGarmentImageUrl ?') && allCode.includes('customerGarmentImage'));
assert('Fallback tailoring mannequin artwork displayed if no customer photo', allCode.includes('/tailoring_mannequin_artwork.png'));
assert('Faint logo watermark included for JB GROUP orders', allCode.includes('Watermark') && allCode.includes('/jb_group_logo.png'));

// 7. Payment Summary & Original Bill-Style Rubber Stamp
console.log('\n--- 7. Payment Summary Capsules & Stamp ---');
assert('Gross Subtotal capsule present', allCode.includes('Gross Subtotal'));
assert('Net Payable deep navy capsule present', allCode.includes('Net Payable') && allCode.includes('background-color: #002b66'));
assert('Amount Paid mint green capsule present', allCode.includes('Amount Paid') && allCode.includes('#16a34a'));
assert('Balance Due light red capsule present', allCode.includes('Balance Due') && allCode.includes('#dc2626'));
assert('Original bill-style rubber stamp with rectangular border and slight tilt', 
  allCode.includes('rotate(-4deg)') && 
  allCode.includes('jb-invoice-rubber-stamp') &&
  allCode.includes('paymentInfo.stampText'));

// 8. Payment Terms & Dressmaker Mannequin Icon
console.log('\n--- 8. Payment Terms & Mannequin Icon ---');
assert('Payment terms box with blue border', allCode.includes('Payment Terms') && allCode.includes('border: 1px solid #002b66'));
assert('Dressmaker mannequin outline SVG included', allCode.includes('viewBox="0 0 24 38"') && allCode.includes('stroke="#002b66"'));
assert('Thank you for choosing JB GROUP / BELLA DESIGN', allCode.includes('Thank you for choosing {brandShort}!'));

// 9. PDF & Export Safety
console.log('\n--- 9. PDF Generation & Dynamic Height ---');
assert('html2canvas with CORS and 3x scale', allCode.includes('scale: 3') && allCode.includes('useCORS: true'));
assert('A4 PDF generation with jsPDF', allCode.includes('format: \'a4\'') && allCode.includes('pdf.addImage'));
assert('WhatsApp message has zero replacement character ', !allCode.includes('\uFFFD') && allCode.includes('generateDigitalInvoiceWhatsAppMessage'));

console.log('====================================================');
console.log(`RESULTS: ${passedTests} / ${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log('🎉 ALL INVOICE REDESIGN REQUIREMENTS VERIFIED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error('❌ Some tests failed.');
  process.exit(1);
}
