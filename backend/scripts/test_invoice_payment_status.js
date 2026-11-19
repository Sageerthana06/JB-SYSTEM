// backend/scripts/test_invoice_payment_status.js
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 DIGITAL INVOICE PAYMENT STATUS TEST SUITE');
console.log('====================================================');

// Extract computeInvoicePaymentStatus & generateDigitalInvoiceWhatsAppMessage from DigitalInvoiceModal.jsx
const componentCode = fs.readFileSync(path.resolve(__dirname, '../../src/components/DigitalInvoiceModal.jsx'), 'utf8');

const fnMatch = componentCode.match(/export const computeInvoicePaymentStatus = ([\s\S]*?^};)/m);
if (!fnMatch) {
  console.error('❌ Could not find computeInvoicePaymentStatus in DigitalInvoiceModal.jsx!');
  process.exit(1);
}
const computeInvoicePaymentStatus = new Function('return ' + fnMatch[1])();

const msgMatch = componentCode.match(/export const generateDigitalInvoiceWhatsAppMessage = ([\s\S]*?^};)/m);
if (!msgMatch) {
  console.error('❌ Could not find generateDigitalInvoiceWhatsAppMessage in DigitalInvoiceModal.jsx!');
  process.exit(1);
}
const generateDigitalInvoiceWhatsAppMessage = new Function('computeInvoicePaymentStatus', 'return ' + msgMatch[1])(computeInvoicePaymentStatus);

let totalTests = 0;
let passedTests = 0;

function assertEqual(testName, actual, expected) {
  totalTests++;
  if (actual === expected) {
    console.log(`  ✅ [PASS] ${testName}: expected "${expected}", got "${actual}"`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}: expected "${expected}", got "${actual}"`);
  }
}

function assertTrue(testName, condition) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
  }
}

// -------------------------------------------------------------------------
// Case 1: LKR 1,600 total / 0 paid -> UNPAID
// -------------------------------------------------------------------------
console.log('\n--- Case 1: LKR 1,600 total / 0 paid -> UNPAID ---');
const orderCase1 = {
  id: 266,
  orderNumber: 'JB-20261109-0003',
  totalAmount: 1600,
  balanceAmount: 1600,
  advancePayment: 0,
  payments: [],
  priceStatus: 'ACCEPTED'
};
const res1 = computeInvoicePaymentStatus(orderCase1);
assertEqual('Case 1 Status Label', res1.label, 'UNPAID');
assertEqual('Case 1 Stamp Text', res1.stampText, 'UNPAID');
assertEqual('Case 1 Status Key', res1.statusKey, 'UNPAID');
assertEqual('Case 1 Stamp Color', res1.stampTextColor, '#dc2626');
assertEqual('Case 1 Balance Label', res1.balanceLabel, 'Balance Due');
assertEqual('Case 1 Total Amount', res1.totalAmount, 1600);
assertEqual('Case 1 Amount Paid', res1.amountPaid, 0);
assertEqual('Case 1 Balance Due', res1.balanceDue, 1600);

// Check WhatsApp message agreement
const waMsg1 = generateDigitalInvoiceWhatsAppMessage(orderCase1);
assertTrue('Case 1 WhatsApp has Balance Payable 1,600.00', waMsg1.includes('Balance Payable: LKR 1,600.00'));
assertTrue('Case 1 WhatsApp has Advance Payment 0.00', waMsg1.includes('Advance Payment: LKR 0.00'));

// -------------------------------------------------------------------------
// Case 1B: Unverified payment must NOT reduce balance
// -------------------------------------------------------------------------
console.log('\n--- Case 1B: Unverified payment must NOT reduce balance ---');
const orderCase1B = {
  id: 267,
  orderNumber: 'JB-20261109-0004',
  totalAmount: 2000,
  payments: [
    { id: 1, amount: 800, status: 'UNVERIFIED' },
    { id: 2, amount: 200, status: 'PENDING' }
  ],
  priceStatus: 'ACCEPTED'
};
const res1B = computeInvoicePaymentStatus(orderCase1B);
assertEqual('Case 1B Unverified payment ignored - Amount Paid', res1B.amountPaid, 0);
assertEqual('Case 1B Balance Due remains full', res1B.balanceDue, 2000);
assertEqual('Case 1B Status Key', res1B.statusKey, 'UNPAID');
assertEqual('Case 1B Stamp Text', res1B.stampText, 'UNPAID');

// -------------------------------------------------------------------------
// Case 2: LKR 1,600 total / 500 verified paid -> PARTIALLY PAID
// -------------------------------------------------------------------------
console.log('\n--- Case 2: LKR 1,600 total / 500 paid -> PARTIALLY PAID ---');
const orderCase2 = {
  id: 268,
  orderNumber: 'JB-20261109-0005',
  totalAmount: 1600,
  payments: [
    { id: 10, amount: 500, status: 'VERIFIED' },
    { id: 11, amount: 300, status: 'PENDING' } // unverified must be ignored
  ],
  priceStatus: 'ACCEPTED'
};
const res2 = computeInvoicePaymentStatus(orderCase2);
assertEqual('Case 2 Status Label', res2.label, 'PARTIALLY PAID');
assertEqual('Case 2 Stamp Text', res2.stampText, 'PARTIALLY PAID');
assertEqual('Case 2 Status Key', res2.statusKey, 'PARTIALLY_PAID');
assertEqual('Case 2 Stamp Color', res2.stampTextColor, '#ea580c');
assertEqual('Case 2 Total Amount', res2.totalAmount, 1600);
assertEqual('Case 2 Amount Paid', res2.amountPaid, 500);
assertEqual('Case 2 Balance Due', res2.balanceDue, 1100);

// Advance payment fallback
const orderCase2B = {
  id: 269,
  orderNumber: 'JB-20261109-0006',
  totalAmount: 1600,
  advancePayment: 500,
  payments: [],
  priceStatus: 'ACCEPTED'
};
const res2B = computeInvoicePaymentStatus(orderCase2B);
assertEqual('Case 2B (advancePayment) Status Label', res2B.label, 'PARTIALLY PAID');
assertEqual('Case 2B (advancePayment) Amount Paid', res2B.amountPaid, 500);
assertEqual('Case 2B (advancePayment) Balance Due', res2B.balanceDue, 1100);

// WhatsApp message agreement
const waMsg2 = generateDigitalInvoiceWhatsAppMessage(orderCase2);
assertTrue('Case 2 WhatsApp has Advance Payment 500.00', waMsg2.includes('Advance Payment: LKR 500.00'));
assertTrue('Case 2 WhatsApp has Balance Payable 1,100.00', waMsg2.includes('Balance Payable: LKR 1,100.00'));

// -------------------------------------------------------------------------
// Case 3: LKR 1,600 total / 1,600 verified paid -> PAID
// -------------------------------------------------------------------------
console.log('\n--- Case 3: LKR 1,600 total / 1,600 paid -> PAID ---');
const orderCase3 = {
  id: 270,
  orderNumber: 'JB-20261109-0007',
  totalAmount: 1600,
  payments: [
    { id: 20, amount: 600, status: 'VERIFIED' },
    { id: 21, amount: 1000, status: 'VERIFIED' }
  ],
  priceStatus: 'ACCEPTED'
};
const res3 = computeInvoicePaymentStatus(orderCase3);
assertEqual('Case 3 Status Label', res3.label, 'PAID');
assertEqual('Case 3 Stamp Text', res3.stampText, 'PAID');
assertEqual('Case 3 Status Key', res3.statusKey, 'PAID');
assertEqual('Case 3 Stamp Color', res3.stampTextColor, '#16a34a');
assertEqual('Case 3 Total Amount', res3.totalAmount, 1600);
assertEqual('Case 3 Amount Paid', res3.amountPaid, 1600);
assertEqual('Case 3 Balance Due', res3.balanceDue, 0);

const waMsg3 = generateDigitalInvoiceWhatsAppMessage(orderCase3);
assertTrue('Case 3 WhatsApp has Advance Payment 1,600.00', waMsg3.includes('Advance Payment: LKR 1,600.00'));
assertTrue('Case 3 WhatsApp has Balance Payable 0.00', waMsg3.includes('Balance Payable: LKR 0.00'));

// -------------------------------------------------------------------------
// Case 4: Price not approved -> PRICE PENDING
// -------------------------------------------------------------------------
console.log('\n--- Case 4: Price not approved -> PRICE PENDING ---');
const orderCase4A = { id: 271, totalAmount: 0, advancePayment: 0, payments: [] };
const res4A = computeInvoicePaymentStatus(orderCase4A);
assertEqual('Case 4A (total 0) Status Label', res4A.label, 'PRICE PENDING');
assertEqual('Case 4A (total 0) Stamp Text', res4A.stampText, 'PRICE PENDING');
assertEqual('Case 4A (total 0) Status Key', res4A.statusKey, 'PRICE_PENDING');
assertEqual('Case 4A (total 0) Stamp Color', res4A.stampTextColor, '#d97706');

const orderCase4B = { id: 272, totalAmount: 2500, priceStatus: 'PENDING', payments: [] };
const res4B = computeInvoicePaymentStatus(orderCase4B);
assertEqual('Case 4B (priceStatus PENDING) Status Label', res4B.label, 'PRICE PENDING');
assertEqual('Case 4B (priceStatus PENDING) Status Key', res4B.statusKey, 'PRICE_PENDING');

const orderCase4C = { id: 273, totalAmount: 2500, status: 'PENDING_APPROVAL', payments: [] };
const res4C = computeInvoicePaymentStatus(orderCase4C);
assertEqual('Case 4C (status PENDING_APPROVAL) Status Label', res4C.label, 'PRICE PENDING');
assertEqual('Case 4C (status PENDING_APPROVAL) Status Key', res4C.statusKey, 'PRICE_PENDING');

// -------------------------------------------------------------------------
// Component Template Verification
// -------------------------------------------------------------------------
console.log('\n--- Component JSX Template Verification ---');
assertTrue('Imports digitalInvoiceStyles', componentCode.includes("import { digitalInvoiceStyles } from './digitalInvoiceStyles';"));
assertTrue('Contains Balance Due pill label', componentCode.includes('<span>Balance Due</span>'));
assertTrue('Contains single rubber stamp element', componentCode.includes('jb-invoice-rubber-stamp'));
assertTrue('Rubber stamp displays paymentInfo.stampText', componentCode.includes('{paymentInfo.stampText}'));
assertTrue('Footer is in natural flow after terms', componentCode.indexOf('jb-invoice-bottom-terms') < componentCode.indexOf('jb-invoice-footer'));

console.log('\n====================================================');
console.log(`RESULTS: ${passedTests} / ${totalTests} assertions passed.`);
if (passedTests === totalTests) {
  console.log('🎉 ALL PAYMENT STATUS & UNVERIFIED GUARD CHECKS PASSED 100%!');
  process.exit(0);
} else {
  console.error('❌ Some tests failed.');
  process.exit(1);
}
