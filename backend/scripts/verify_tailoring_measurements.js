// Comprehensive Verification Script for Tailoring Measurements Workflow
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { validateDressMeasurements } = require('../src/utils/measurementValidation');

const BASE_URL = 'http://127.0.0.1:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('TAILORING MEASUREMENTS SYSTEM VERIFICATION');
  console.log('====================================================\n');

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

  // ----------------------------------------------------
  // TEST 1: Validation Rules for All Dress Types
  // ----------------------------------------------------
  console.log('--- TEST 1: Validation Rules for All 8 Dress Types ---');
  
  // 1a: Saree Blouse Missing Bust
  const blouseMissingBust = validateDressMeasurements('Saree Blouse', {
    underBust: 72, waist: 68, armhole: 40, sleeveLength: 26, blouseLength: 38
  });
  assert(!blouseMissingBust.valid && blouseMissingBust.message.includes('Bust'), 'Saree Blouse rejects missing Bust');

  // 1b: Saree Blouse Complete
  const blouseComplete = validateDressMeasurements('Saree Blouse', {
    bust: 86, underBust: 72, waist: 68, armhole: 40, sleeveLength: 26, blouseLength: 38
  });
  assert(blouseComplete.valid, 'Saree Blouse passes with complete required measurements');

  // 1c: Frock Complete
  const frockComplete = validateDressMeasurements('Frock', {
    bust: 88, waist: 70, hip: 94, armhole: 42, frockLength: 120
  });
  assert(frockComplete.valid, 'Frock passes with complete required measurements');

  // 1d: Lehenga Complete
  const lehengaComplete = validateDressMeasurements('Lehenga', {
    bust: 86, waist: 70, hip: 96, blouseLength: 38, lehengaWaist: 74, lehengaLength: 105
  });
  assert(lehengaComplete.valid, 'Lehenga passes with complete required measurements');

  // 1e: Skirt Complete
  const skirtComplete = validateDressMeasurements('Skirt', {
    waist: 72, hip: 96, skirtLength: 95
  });
  assert(skirtComplete.valid, 'Skirt passes with complete required measurements');

  // 1f: Top Complete
  const topComplete = validateDressMeasurements('Top', {
    bust: 86, waist: 70, hip: 94, armhole: 40, topLength: 70
  });
  assert(topComplete.valid, 'Top passes with complete required measurements');

  // 1g: Uniform Complete
  const uniformComplete = validateDressMeasurements('Uniform', {
    chestBust: 90, waist: 78, shirtTopLength: 72
  });
  assert(uniformComplete.valid, 'Uniform passes with complete required measurements');

  // 1h: Alteration Complete
  const alterationComplete = validateDressMeasurements('Alteration', {
    currentGarmentType: 'Saree Blouse',
    requiredAlteration: 'Tighten sides by 2cm',
    requiredMeasurement: 'Bust 84cm, Waist 68cm'
  });
  assert(alterationComplete.valid, 'Alteration passes with complete required measurements');

  // 1i: Alteration Missing Required Target Measurement
  const alterationMissingTarget = validateDressMeasurements('Alteration', {
    currentGarmentType: 'Saree Blouse',
    requiredAlteration: 'Tighten sides by 2cm'
  });
  assert(!alterationMissingTarget.valid, 'Alteration rejects missing target measurement');

  // ----------------------------------------------------
  // TEST 2: CEO & Staff Login
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Authentication ---');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ceo@jbgroup.com', password: '@Bella202CEO6' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.token || loginData.token;
  assert(Boolean(token), 'Staff/CEO logged in successfully');

  // ----------------------------------------------------
  // TEST 3: Create New Customer with Complete Saree Blouse Order
  // ----------------------------------------------------
  console.log('\n--- TEST 3: API Flow - New Customer + Saree Blouse Order ---');
  
  const testPhone = `+9477${Math.floor(1000000 + Math.random() * 9000000)}`;

  const res1 = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      customerName: 'Kavitha Sivarajah',
      primaryContact: testPhone,
      customerType: 'NEW',
      branchId: 1,
      garmentDetails: {
        dressType: 'Saree Blouse',
        quantity: 1,
        fabricType: 'Silk',
        fabricColour: 'Maroon',
        measurementUnit: 'cm',
        fitPreference: 'Regular',
        measurements: {
          bust: 88,
          underBust: 74,
          waist: 70,
          armhole: 40,
          sleeveLength: 26,
          blouseLength: 38,
          frontNeck: 18,
          backNeck: 24
        }
      },
      paymentDetails: {
        totalAmount: 4500,
        advancePayment: 2000
      }
    })
  });

  const data1 = await res1.json();
  assert(data1.success === true, `Order created for new customer (Order: ${data1.order?.orderNumber})`);
  assert(data1.order?.status === 'PENDING_APPROVAL', 'Order status is PENDING_APPROVAL (Preserved approval workflow)');
  assert(data1.order?.garmentDetails?.measurementUnit === 'cm', 'Measurement unit saved as cm');
  assert(data1.order?.garmentDetails?.measurements?.bust === 88, 'Measurement bust value stored accurately (88 cm)');

  const createdCustomerId = data1.customer?.id;

  // ----------------------------------------------------
  // TEST 4: Returning Customer Measurement Retrieval
  // ----------------------------------------------------
  console.log('\n--- TEST 4: API Flow - Returning Customer Measurement Retrieval ---');
  
  const resLatest = await fetch(`${BASE_URL}/customers/${createdCustomerId}/measurements/latest?dressType=Saree%20Blouse`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const latestData = await resLatest.json();
  assert(latestData.success === true, 'Successfully fetched previous measurements');
  assert(latestData.measurement?.dressType === 'Saree Blouse', 'Retrieved dress type matches Saree Blouse');
  assert(latestData.measurement?.measurements?.bust === 88, 'Retrieved previous bust measurement matches 88cm');

  // ----------------------------------------------------
  // TEST 5: Returning Customer Creating New Order (Snapshot Preservation)
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Returning Customer - New Order with Modified Measurements ---');
  
  const res2 = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      primaryContact: testPhone,
      customerType: 'RETURNING',
      branchId: 1,
      garmentDetails: {
        dressType: 'Frock',
        quantity: 1,
        fabricType: 'Georgette',
        measurementUnit: 'cm',
        fitPreference: 'Tight',
        measurements: {
          bust: 90,
          waist: 72,
          hip: 96,
          armhole: 42,
          frockLength: 125
        }
      },
      paymentDetails: {
        totalAmount: 6000,
        advancePayment: 3000
      }
    })
  });

  const data2 = await res2.json();
  assert(data2.success === true, `Second order created for returning customer (Order: ${data2.order?.orderNumber})`);
  assert(data2.order?.garmentDetails?.dressType === 'Frock', 'Second order dress type is Frock');
  assert(data2.order?.garmentDetails?.measurements?.bust === 90, 'Second order stores independent measurement snapshot (90cm)');

  // ----------------------------------------------------
  // TEST 6: Backend Rejection on Missing Required Measurement
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Backend Validation - Missing Required Measurements ---');
  
  const resInvalid = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      primaryContact: testPhone,
      customerType: 'RETURNING',
      branchId: 1,
      garmentDetails: {
        dressType: 'Saree Blouse',
        quantity: 1,
        measurements: {
          // Missing bust, waist, armhole, etc.
          shoulder: 36
        }
      },
      paymentDetails: {
        totalAmount: 4000
      }
    })
  });

  const dataInvalid = await resInvalid.json();
  assert(dataInvalid.success === false, 'Backend rejected order with missing required measurements');
  assert(dataInvalid.message && dataInvalid.message.includes('Please enter'), `Clear validation message returned: "${dataInvalid.message}"`);

  // ----------------------------------------------------
  // TEST 7: Alteration Order Creation
  // ----------------------------------------------------
  console.log('\n--- TEST 7: API Flow - Alteration Order ---');
  const resAlt = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      primaryContact: testPhone,
      customerType: 'RETURNING',
      branchId: 1,
      garmentDetails: {
        dressType: 'Alteration',
        quantity: 1,
        measurementUnit: 'cm',
        measurements: {
          currentGarmentType: 'Saree Blouse',
          requiredAlteration: 'Tighten waist & reduce sleeve length',
          currentMeasurement: 'Waist 76 cm, Sleeve 28 cm',
          requiredMeasurement: 'Waist 70 cm, Sleeve 25 cm',
          waistAdjustment: 'Take in 6 cm',
          sleeveAdjustment: 'Shorten 3 cm',
          alterationInstructions: 'Keep original inner margins intact'
        }
      },
      paymentDetails: {
        totalAmount: 1500,
        advancePayment: 1500
      }
    })
  });

  const dataAlt = await resAlt.json();
  assert(dataAlt.success === true, `Alteration order created successfully (Order: ${dataAlt.order?.orderNumber})`);
  assert(dataAlt.order?.garmentDetails?.measurements?.requiredMeasurement === 'Waist 70 cm, Sleeve 25 cm', 'Alteration specific measurements captured accurately');

  // ----------------------------------------------------
  // CLEANUP TEST FIXTURES
  // ----------------------------------------------------
  try {
    const { prisma } = require('../src/prisma');
    const createdCust = await prisma.customer.findFirst({ where: { primaryPhone: testPhone }, include: { orders: true } });
    if (createdCust) {
      const oIds = createdCust.orders.map(o => o.id);
      if (oIds.length > 0) {
        await prisma.productionHistory.deleteMany({ where: { orderId: { in: oIds } } });
        await prisma.garmentDetails.deleteMany({ where: { orderId: { in: oIds } } });
        await prisma.payment.deleteMany({ where: { orderId: { in: oIds } } });
        await prisma.order.deleteMany({ where: { id: { in: oIds } } });
      }
      await prisma.customerMeasurement.deleteMany({ where: { customerId: createdCust.id } });
      await prisma.customer.delete({ where: { id: createdCust.id } });
      console.log('Test fixtures cleaned up from PostgreSQL.');
    }
  } catch (cleanErr) {
    console.warn('Cleanup notice:', cleanErr.message);
  }

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
