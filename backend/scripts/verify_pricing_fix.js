// Comprehensive Verification of Order Pricing Fix (Dilan Perera Bridal Lehenga Case)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = 'http://127.0.0.1:5000/api';

async function testPricing() {
  console.log('================================================================');
  console.log('ORDER PRICING FIX VERIFICATION');
  console.log('Testing "Server error setting order price" fix & Dilan Perera case');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${message}${details ? ' - ' + details : ''}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}${details ? ' - ' + details : ''}`);
      failed++;
    }
  }

  // 1. CEO Authentication
  console.log('--- 1. CEO Authentication ---');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ceo@jbgroup.com', password: '@Bella202CEO6' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token || loginData.token;
  assert(Boolean(token), 'CEO / Manager authenticated successfully');

  // 2. Create Order for Dilan Perera (Bridal Lehenga)
  console.log('\n--- 2. Create Order for Dilan Perera (Bridal Lehenga) ---');
  const testPhone = `+9477${Math.floor(1000000 + Math.random() * 9000000)}`;
  const orderRes = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      customerName: 'Dilan Perera',
      primaryContact: testPhone,
      customerType: 'NEW',
      branchId: 1,
      garmentDetails: {
        dressType: 'Bridal Lehenga',
        quantity: 1,
        fabricType: 'Silk Velvet',
        fabricColour: 'Crimson Gold',
        measurementUnit: 'cm',
        fitPreference: 'Regular',
        measurements: {
          bust: 88,
          waist: 72,
          hip: 96,
          blouseLength: 38,
          lehengaWaist: 74,
          lehengaLength: 105
        }
      },
      paymentDetails: {
        totalAmount: 0,
        advancePayment: 0
      }
    })
  });

  const orderData = await orderRes.json();
  assert(orderData.success === true, `Order created for Dilan Perera (${orderData.order?.orderNumber})`);
  const orderId = orderData.order?.id;

  // Management approval required before pricing
  const approveRes = await fetch(`${BASE_URL}/orders/${orderId}/approve`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const approveData = await approveRes.json();
  assert(approveData.success === true, `Order approved by CEO (status: ${approveData.order?.status})`);

  // 3. Test: Save & Send Quote (Tailoring: 1000, Aari: 0, Material: 0, Discount: 10, Advance: 0 => Total: 990, Balance: 990)
  console.log('\n--- 3. Test "Save & Send Quote" (1000 + 0 + 0 - 10 = 990 LKR) ---');
  const quoteRes = await fetch(`${BASE_URL}/orders/${orderId}/price`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      serviceCharge: 1000,
      additionalWorkCharge: 0,
      materialCharge: 0,
      discountAmount: 10,
      advanceRequired: 0,
      notes: 'Bridal Lehenga tailored quote for Dilan Perera',
      directAccept: false
    })
  });

  const quoteData = await quoteRes.json();
  assert(quoteData.success === true, 'No 500 server error; Quote saved successfully');
  assert(quoteData.order?.totalAmount === 990, 'Total final price is 990 LKR (1000 - 10)');
  assert(quoteData.order?.balanceAmount === 990, 'Balance on delivery is 990 LKR');
  assert(quoteData.order?.priceStatus === 'SENT', 'Price status is SENT (awaiting customer confirmation)');
  assert(quoteData.order?.status === 'APPROVED', 'Order status is APPROVED (ready for quote delivery, not prematurely confirmed)');
  assert(quoteData.order?.assignedTailorId === null || quoteData.order?.assignedTailorId === undefined, 'No tailor automatically assigned during quote');

  // 4. Test: Direct Confirm & Accept
  console.log('\n--- 4. Test "Direct Confirm & Accept" ---');
  const directRes = await fetch(`${BASE_URL}/orders/${orderId}/price`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      serviceCharge: 1000,
      additionalWorkCharge: 0,
      materialCharge: 0,
      discountAmount: 10,
      advanceRequired: 200,
      notes: 'Directly confirmed with customer via phone',
      directAccept: true
    })
  });

  const directData = await directRes.json();
  assert(directData.success === true, 'Direct Confirm & Accept succeeded');
  assert(directData.order?.totalAmount === 990, 'Total final price remains 990 LKR');
  assert(directData.order?.advanceRequired === 200, 'Advance required updated to 200 LKR');
  assert(directData.order?.priceStatus === 'ACCEPTED', 'Price status is ACCEPTED');
  assert(directData.order?.status === 'ORDER_CONFIRMED', 'Order status is ORDER_CONFIRMED (ready for tailor assignment)');

  // 5. Test Backend Validation (Advance exceeding Total)
  console.log('\n--- 5. Backend Validation - Advance > Total Rejection ---');
  const invalidRes = await fetch(`${BASE_URL}/orders/${orderId}/price`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      serviceCharge: 1000,
      discountAmount: 10,
      advanceRequired: 1500, // Invalid: exceeds 990
      directAccept: false
    })
  });

  const invalidData = await invalidRes.json();
  assert(invalidData.success === false, 'Invalid advance payment rejected safely');
  assert(invalidData.message?.includes('cannot exceed'), `Useful validation message: "${invalidData.message}"`);

  // 6. Production History Record Check
  console.log('\n--- 6. Production History Integrity ---');
  const histRes = await fetch(`${BASE_URL}/orders/${orderId}/history`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const histData = await histRes.json();
  assert(histData.success === true, 'Order production history retrieved cleanly');
  assert(Array.isArray(histData.history) && histData.history.length > 0, `Recorded ${histData.history?.length} history steps including pricing`);

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

testPricing().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
