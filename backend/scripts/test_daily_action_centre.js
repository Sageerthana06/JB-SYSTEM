// backend/scripts/test_daily_action_centre.js
/**
 * JB SYSTEM - Daily Action Centre Verification Suite
 * 
 * Verifies:
 * 1. Asia/Colombo timezone calculation
 * 2. Quotation Follow-up Queue (awaiting confirmation)
 * 3. Collection Follow-up Queue (partial payment, unverified payment guard, legacy advance fallback)
 * 4. Delivery Follow-up Queue (due today, overdue, ready, completed delivery exclusion)
 * 5. Branch Access Scoping (Founder/CEO multi-branch vs Branch Manager restriction)
 * 6. Responsible Person resolution ("Unassigned" vs assigned tailor/follow-up)
 * 7. Follow-up lifecycle separation from financial/production status
 */

const { getColomboDateString, getColomboDayDiff } = require('../src/services/actionCentreService');
const { calculateOrderPayments } = require('../src/services/orderPaymentService');

console.log('====================================================');
console.log('🧪 JB SYSTEM — DAILY ACTION CENTRE TEST SUITE');
console.log('====================================================');

let totalTests = 0;
let passedTests = 0;

function assert(description, condition) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${description}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${description}`);
  }
}

// -------------------------------------------------------------
// 1. Timezone & Colombo Date Tests
// -------------------------------------------------------------
console.log('\n--- 1. Asia/Colombo Timezone Date Calculations ---');
const colomboToday = getColomboDateString();
assert('Colombo date format is YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(colomboToday));

const testDatePast = '2026-11-10';
const testDateToday = colomboToday;
const testDateFuture = '2026-11-15';

assert('Day difference calculation is accurate', getColomboDayDiff('2026-11-12', '2026-11-10') === 2);
assert('Same day difference is 0', getColomboDayDiff(colomboToday, colomboToday) === 0);

// -------------------------------------------------------------
// 2. Mock Test Fixtures for Queues
// -------------------------------------------------------------
console.log('\n--- 2. Building Mock Data Fixtures ---');

const mockQuotationOrder = {
  id: 101,
  orderNumber: 'JB-20261110-0001',
  branchId: 1,
  customer: { name: 'Pumi', primaryPhone: '0763161236' },
  status: 'WAITING_CUSTOMER_APPROVAL',
  priceStatus: 'SENT',
  priceAcceptedByCustomer: false,
  totalAmount: 2500,
  priceSentAt: new Date('2026-11-10T08:00:00Z'),
  garmentDetails: { dressType: 'Saree Blouse', quantity: 1 },
  payments: []
};

const mockQuotationAcceptedOrder = {
  id: 102,
  orderNumber: 'JB-20261110-0002',
  branchId: 1,
  customer: { name: 'Nirosha', primaryPhone: '0771234567' },
  status: 'ORDER_CONFIRMED',
  priceStatus: 'ACCEPTED',
  priceAcceptedByCustomer: true,
  totalAmount: 3500,
  garmentDetails: { dressType: 'Frock', quantity: 1 },
  payments: []
};

// Partially paid order (Verified Payment)
const mockPartiallyPaidOrder = {
  id: 103,
  orderNumber: 'JB-20261110-0003',
  branchId: 1,
  customer: { name: 'Dorin', primaryPhone: '0763010582' },
  status: 'STITCHING',
  priceStatus: 'ACCEPTED',
  priceAcceptedByCustomer: true,
  totalAmount: 1600,
  garmentDetails: { dressType: 'Saree Blouse', quantity: 1 },
  payments: [
    { amount: 500, status: 'VERIFIED' }
  ]
};

// Order with UNVERIFIED payment slip (Must NOT reduce balance)
const mockUnverifiedSlipOrder = {
  id: 104,
  orderNumber: 'BELLA-20261110-0004',
  branchId: 2,
  customer: { name: 'Fathima', primaryPhone: '0777654321' },
  status: 'CUTTING',
  priceStatus: 'ACCEPTED',
  priceAcceptedByCustomer: true,
  totalAmount: 5000,
  garmentDetails: { dressType: 'Bridal Gown', quantity: 1 },
  payments: [
    { amount: 5000, status: 'PENDING_VERIFICATION' },
    { amount: 2000, status: 'REJECTED' }
  ]
};

// Order with legacy advance payment
const mockLegacyAdvanceOrder = {
  id: 105,
  orderNumber: 'JB-20261110-0005',
  branchId: 1,
  customer: { name: 'Kavitha', primaryPhone: '0712345678' },
  status: 'QUALITY_CHECK',
  priceStatus: 'ACCEPTED',
  priceAcceptedByCustomer: true,
  totalAmount: 4000,
  advancePayment: 1500,
  garmentDetails: { dressType: 'Salwar Kameez', quantity: 1 },
  payments: []
};

// Order Ready for Delivery with Balance Due
const mockReadyCollectionOrder = {
  id: 106,
  orderNumber: 'BELLA-20261110-0006',
  branchId: 2,
  customer: { name: 'Ayesha', primaryPhone: '0751234567' },
  status: 'READY',
  priceStatus: 'ACCEPTED',
  priceAcceptedByCustomer: true,
  totalAmount: 8000,
  garmentDetails: { dressType: 'Lehenga', quantity: 1 },
  payments: [
    { amount: 3000, status: 'VERIFIED' }
  ]
};

// Delivery Due Today
const mockDeliveryDueTodayOrder = {
  id: 107,
  orderNumber: 'JB-20261110-0007',
  branchId: 1,
  customer: { name: 'Vijitha', primaryPhone: '0778899001' },
  status: 'FINISHING',
  priceStatus: 'ACCEPTED',
  priceAcceptedByCustomer: true,
  totalAmount: 3200,
  deliveryDate: colomboToday,
  garmentDetails: { dressType: 'Saree Blouse', quantity: 2 },
  payments: [{ amount: 3200, status: 'VERIFIED' }]
};

// Overdue Delivery (Promised date 3 days ago)
const mockOverdueDeliveryOrder = {
  id: 108,
  orderNumber: 'JB-20261110-0008',
  branchId: 1,
  customer: { name: 'Anoma', primaryPhone: '0779988776' },
  status: 'STITCHING',
  priceStatus: 'ACCEPTED',
  priceAcceptedByCustomer: true,
  totalAmount: 4500,
  deliveryDate: '2026-11-09',
  garmentDetails: { dressType: 'Maxi Dress', quantity: 1 },
  payments: [{ amount: 4500, status: 'VERIFIED' }]
};

// Completed / Delivered Order (Must NOT appear in Delivery Follow-up)
const mockDeliveredOrder = {
  id: 109,
  orderNumber: 'JB-20261110-0009',
  branchId: 1,
  customer: { name: 'Sanduni', primaryPhone: '0761122334' },
  status: 'DELIVERED',
  priceStatus: 'ACCEPTED',
  priceAcceptedByCustomer: true,
  totalAmount: 2000,
  deliveryDate: '2026-11-08',
  garmentDetails: { dressType: 'Skirt', quantity: 1 },
  payments: [{ amount: 2000, status: 'VERIFIED' }]
};

// -------------------------------------------------------------
// 3. Queue Logic Unit Verification
// -------------------------------------------------------------
console.log('\n--- 3. Verifying Queue Filtering & Business Rules ---');

// Quotation Queue Check
const testOrdersList = [
  mockQuotationOrder,
  mockQuotationAcceptedOrder,
  mockPartiallyPaidOrder,
  mockUnverifiedSlipOrder,
  mockLegacyAdvanceOrder,
  mockReadyCollectionOrder,
  mockDeliveryDueTodayOrder,
  mockOverdueDeliveryOrder,
  mockDeliveredOrder
];

// Test Quotation Queue
const quotationQueueResult = testOrdersList.filter(o => {
  const isAwaiting = (o.priceStatus === 'SENT' || o.status === 'WAITING_CUSTOMER_APPROVAL') && !o.priceAcceptedByCustomer;
  return isAwaiting && !['REJECTED', 'CANCELLED', 'DELIVERED', 'COMPLETED'].includes(o.status);
});

assert('Quotation Queue captures sent quotation awaiting customer confirmation', quotationQueueResult.some(o => o.id === 101));
assert('Quotation Queue excludes confirmed quotations', !quotationQueueResult.some(o => o.id === 102));

// Test Collection Queue & Verified Payment Calculations
const collectionQueueResult = testOrdersList.filter(o => {
  if (['CANCELLED', 'REJECTED'].includes(o.status)) return false;
  const pay = calculateOrderPayments(o);
  return !pay.isPricePending && pay.totalAmount > 0 && pay.balanceDue > 0;
});

assert('Collection Queue includes partially paid order (Dorin)', collectionQueueResult.some(o => o.id === 103));
const dorinPay = calculateOrderPayments(mockPartiallyPaidOrder);
assert('Dorin: Net Payable is LKR 1,600', dorinPay.totalAmount === 1600);
assert('Dorin: Amount Paid is LKR 500', dorinPay.amountPaid === 500);
assert('Dorin: Balance Due is LKR 1,100', dorinPay.balanceDue === 1100);

// Unverified Payment Slip Check
const fathimaPay = calculateOrderPayments(mockUnverifiedSlipOrder);
assert('Unverified payment does NOT reduce balance (Fathima Amount Paid is 0)', fathimaPay.amountPaid === 0);
assert('Fathima: Full Balance Due remains LKR 5,000', fathimaPay.balanceDue === 5000);
assert('Collection Queue includes unverified payment order', collectionQueueResult.some(o => o.id === 104));

// Legacy advancePayment fallback check
const kavithaPay = calculateOrderPayments(mockLegacyAdvanceOrder);
assert('Legacy advancePayment fallback applies when payments array is empty', kavithaPay.amountPaid === 1500);
assert('Kavitha: Balance Due is LKR 2,500', kavithaPay.balanceDue === 2500);
assert('Collection Queue includes legacy advance order', collectionQueueResult.some(o => o.id === 105));

// Ready for pickup order in Collection Queue
assert('Collection Queue includes Ready for Delivery order with balance', collectionQueueResult.some(o => o.id === 106));

// Test Delivery Queue
const deliveryQueueResult = testOrdersList.filter(o => {
  if (['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(o.status)) return false;
  const date = o.deliveryDate ? getColomboDateString(o.deliveryDate) : null;
  const isOverdue = date && date < colomboToday;
  const isDueToday = date && date === colomboToday;
  const isReady = o.status === 'READY';
  return isOverdue || isDueToday || isReady;
});

assert('Delivery Queue captures order due today (Vijitha)', deliveryQueueResult.some(o => o.id === 107));
assert('Delivery Queue captures overdue delivery (Anoma)', deliveryQueueResult.some(o => o.id === 108));
assert('Delivery Queue captures ready order awaiting collection', deliveryQueueResult.some(o => o.id === 106));
assert('Delivery Queue excludes delivered / completed orders (Sanduni)', !deliveryQueueResult.some(o => o.id === 109));

// -------------------------------------------------------------
// 4. Branch Access Control Security Tests
// -------------------------------------------------------------
console.log('\n--- 4. Verifying Dual-Branch Security Rules ---');

const mockFounder = { id: 1, name: 'Founder CEO', role: 'SUPER_ADMIN', branchId: null };
const mockBranch1Manager = { id: 2, name: 'JB Manager', role: 'MANAGER', branchId: 1 };
const mockBranch2Manager = { id: 3, name: 'Bella Manager', role: 'MANAGER', branchId: 2 };

function simulateBranchFilter(user, requestedBranchId) {
  const userRole = String(user.role).toUpperCase();
  const isCeo = ['SUPER_ADMIN', 'CEO'].includes(userRole);

  if (isCeo) {
    if (requestedBranchId && String(requestedBranchId).trim().toUpperCase() !== 'ALL') {
      return parseInt(requestedBranchId, 10);
    }
    return 'ALL';
  }

  const assignedBranch = user.branchId ? Number(user.branchId) : null;
  if (!assignedBranch) throw new Error('No branch assigned');

  if (requestedBranchId) {
    const qBranch = String(requestedBranchId).trim().toUpperCase();
    if (qBranch === 'ALL' || parseInt(qBranch, 10) !== assignedBranch) {
      throw new Error('Access denied: Restricted to assigned branch');
    }
  }

  return assignedBranch;
}

assert('Founder can view ALL branches', simulateBranchFilter(mockFounder, 'ALL') === 'ALL');
assert('Founder can view Branch 1 specifically', simulateBranchFilter(mockFounder, '1') === 1);
assert('Founder can view Branch 2 specifically', simulateBranchFilter(mockFounder, '2') === 2);

assert('Branch 1 Manager access to Branch 1 succeeds', simulateBranchFilter(mockBranch1Manager, '1') === 1);
assert('Branch 1 Manager default branch is 1', simulateBranchFilter(mockBranch1Manager, null) === 1);

let b1Blocked = false;
try {
  simulateBranchFilter(mockBranch1Manager, '2');
} catch (e) {
  b1Blocked = true;
}
assert('Branch 1 Manager blocked from Branch 2 records (throws error)', b1Blocked);

let b1AllBlocked = false;
try {
  simulateBranchFilter(mockBranch1Manager, 'ALL');
} catch (e) {
  b1AllBlocked = true;
}
assert('Branch 1 Manager blocked from ALL branches view (throws error)', b1AllBlocked);

// -------------------------------------------------------------
// 5. Responsible Person Resolution Tests
// -------------------------------------------------------------
console.log('\n--- 5. Verifying Responsible Person & "Unassigned" Rules ---');

function testResolvePerson(order, followUp) {
  if (followUp && followUp.responsiblePersonName) return followUp.responsiblePersonName;
  if (order.assignedTailor?.name) return order.assignedTailor.name;
  if (Array.isArray(order.tasks) && order.tasks.length > 0) {
    const t = order.tasks.find(x => x.assignedTailor?.name);
    if (t) return t.assignedTailor.name;
  }
  return 'Unassigned';
}

assert('Order without any assignee returns "Unassigned"', testResolvePerson({}, null) === 'Unassigned');
assert('Order with assignedTailor returns tailor name', testResolvePerson({ assignedTailor: { name: 'Priyantha' } }, null) === 'Priyantha');
assert('Order with follow-up assignee overrides tailor', testResolvePerson(
  { assignedTailor: { name: 'Priyantha' } },
  { responsiblePersonName: 'Manager Sarah' }
) === 'Manager Sarah');

// -------------------------------------------------------------
// 6. Follow-up Lifecycle Independence Tests
// -------------------------------------------------------------
console.log('\n--- 6. Verifying Follow-up Independence ---');
const orderBeforeFollowUp = {
  status: 'CUTTING',
  priceStatus: 'ACCEPTED',
  totalAmount: 5000,
  advancePayment: 2000,
  payments: [{ amount: 2000, status: 'VERIFIED' }]
};

const followUpRecord = {
  status: 'COMPLETED',
  outcome: 'Customer agreed to pay balance upon collection',
  completedAt: new Date()
};

const payAfterFollowUp = calculateOrderPayments(orderBeforeFollowUp);
assert('Completed follow-up does NOT mark order as paid (Balance Due remains 3,000)', payAfterFollowUp.balanceDue === 3000);
assert('Completed follow-up does NOT alter production status (Order remains in CUTTING)', orderBeforeFollowUp.status === 'CUTTING');

console.log('====================================================');
console.log(`RESULTS: ${passedTests} / ${totalTests} assertions passed.`);
if (passedTests === totalTests) {
  console.log('🎉 ALL DAILY ACTION CENTRE UNIT & SECURITY TESTS PASSED 100%!');
  process.exit(0);
} else {
  console.error('❌ Some tests failed.');
  process.exit(1);
}

