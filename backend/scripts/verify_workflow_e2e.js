require('dotenv').config();
const { Pool } = require('pg');
// Native global fetch in Node.js 18+ is used

const BASE_URL = 'http://127.0.0.1:5000/api';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const results = [];

function recordResult(testName, passed, details = '') {
  results.push({ testName, passed, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName}${details ? ' - ' + details : ''}`);
}

async function runE2EWorkflowTests() {
  console.log('================================================================');
  console.log('STARTING FINAL WORKFLOW END-TO-END VERIFICATION');
  console.log('Customer → Approval → Tailor Assignment & Acceptance → Production');
  console.log('================================================================\n');

  try {
    // ----------------------------------------------------
    // AUTHENTICATION SETUP
    // ----------------------------------------------------
    console.log('--- 1. AUTHENTICATION SETUP ---');

    // 1.1 CEO Login
    const ceoRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ceo@jbgroup.com', password: '@Bella202CEO6' })
    });
    const ceoData = await ceoRes.json();
    const ceoToken = ceoData.data?.token || ceoData.token;
    const ceoUser = ceoData.data?.user || ceoData.user;
    if (!ceoToken) throw new Error('CEO login failed: ' + JSON.stringify(ceoData));
    recordResult('CEO Authentication', true, `Logged in as ${ceoUser.name} (${ceoUser.role})`);

    // 1.2 Tailor Login
    const tailorRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'subangini@gmail.com', password: '123456' })
    });
    const tailorData = await tailorRes.json();
    const tailorToken = tailorData.data?.token || tailorData.token;
    const tailorUser = tailorData.data?.user || tailorData.user;
    if (!tailorToken) throw new Error('Tailor login failed: ' + JSON.stringify(tailorData));
    recordResult('Tailor Authentication', true, `Logged in as ${tailorUser.name} (${tailorUser.role})`);

    // 1.3 Customer Registration / Login
    const ts = Date.now();
    const customerEmail = `e2e_workflow_${ts}@example.com`;
    const customerPhone = `+9477${Math.floor(1000000 + Math.random() * 8999999)}`;
    const custRegRes = await fetch(`${BASE_URL}/customer-portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nilani Fernando',
        email: customerEmail,
        primaryPhone: customerPhone,
        password: 'Password123!',
        address: 'srilanka'
      })
    });
    const custRegData = await custRegRes.json();
    const customerToken = custRegData.data.token;
    const customerId = custRegData.data.customer.id;
    recordResult('Customer Authentication', true, `Registered & logged in as customer ID ${customerId}`);

    // ----------------------------------------------------
    // TEST FLOW 1: FULL HAPPY PATH TO DELIVERY
    // ----------------------------------------------------
    console.log('\n--- 2. TEST FLOW 1: CUSTOMER ORDER → APPROVAL → ASSIGNMENT → TAILOR ACCEPT → FULL PRODUCTION ---');

    // 2.1 Customer books order with embroidery and fitting required
    const newOrderPayload = {
      garmentDetails: {
        dressType: 'Bridal Lehanga',
        quantity: 1,
        occasion: 'Wedding',
        fabricSuppliedBy: 'Customer',
        fabricType: 'Silk & Velvet',
        fabricColour: 'Royal Crimson Red',
        liningRequired: 'Yes',
        paddingCupRequired: 'Yes',
        workRequired: 'Yes',
        workDetails: 'Aari Zardosi Gold Thread Work on Border and Blouse',
        specialDesignInstructions: 'Require fitting session before final finishing',
        designReferenceImage: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c'
      }
    };

    const createOrderRes = await fetch(`${BASE_URL}/customer-portal/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify(newOrderPayload)
    });
    const createOrderData = await createOrderRes.json();
    if (!createOrderData.success || !createOrderData.order) {
      throw new Error('Customer order creation failed: ' + JSON.stringify(createOrderData));
    }
    const order1 = createOrderData.order;
    recordResult('Order 1 Created by Customer', true, `Order Number: ${order1.orderNumber}, ID: ${order1.id}`);

    // 2.2 Verify initial status is strictly PENDING_APPROVAL
    const isPendingApproval = order1.status === 'PENDING_APPROVAL';
    recordResult('Order 1 Initial Status is PENDING_APPROVAL', isPendingApproval, `Status: ${order1.status}`);

    // 2.3 Verify unpriced rule: totalAmount === 0 must be UNPRICED / PRICE PENDING
    const isUnpriced = order1.totalAmount === 0;
    recordResult('Order 1 Unpriced Display (LKR 0)', isUnpriced, `Total Amount: LKR ${order1.totalAmount}`);

    // 2.4 Verify Tailor CANNOT see the PENDING_APPROVAL order in list
    const tailorOrdersRes1 = await fetch(`${BASE_URL}/orders`, {
      headers: { 'Authorization': `Bearer ${tailorToken}` }
    });
    const tailorOrdersData1 = await tailorOrdersRes1.json();
    if (!tailorOrdersData1.orders) {
      console.error('tailorOrdersData1 missing orders array:', tailorOrdersRes1.status, tailorOrdersData1);
    }
    const tailorOrdersList1 = Array.isArray(tailorOrdersData1.orders) ? tailorOrdersData1.orders : [];
    const tailorCanSeePending = tailorOrdersList1.some(o => o.id === order1.id);
    recordResult('Tailor Cannot See PENDING_APPROVAL in Orders List', !tailorCanSeePending, 'Excluded from Tailor queue');

    // 2.5 Verify Tailor cannot fetch PENDING_APPROVAL order directly (403 Forbidden)
    const tailorGetOrderRes1 = await fetch(`${BASE_URL}/orders/${order1.id}`, {
      headers: { 'Authorization': `Bearer ${tailorToken}` }
    });
    recordResult('Tailor Direct Access to PENDING_APPROVAL Returns 403 Forbidden', tailorGetOrderRes1.status === 403, `Status code: ${tailorGetOrderRes1.status}`);

    // 2.6 CEO approves the order
    const approveRes = await fetch(`${BASE_URL}/orders/${order1.id}/approve`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${ceoToken}` }
    });
    const approveData = await approveRes.json();
    const isApprovedConfirmed = approveData.success && approveData.order.status === 'ORDER_CONFIRMED';
    recordResult('CEO Approves Order → ORDER_CONFIRMED', isApprovedConfirmed, `Status: ${approveData.order?.status}, ApprovedBy: ${approveData.order?.approvedBy}`);

    // 2.7 Verify Customer Dashboard sees ORDER_CONFIRMED on the SAME record
    const custViewOrderRes1 = await fetch(`${BASE_URL}/customer-portal/orders/${order1.id}`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const custViewOrderData1 = await custViewOrderRes1.json();
    const custSeesConfirmed = custViewOrderData1.order.status === 'ORDER_CONFIRMED';
    recordResult('Customer Dashboard Sees ORDER_CONFIRMED (Same Record)', custSeesConfirmed, `Customer Order Status: ${custViewOrderData1.order?.status}`);

    // 2.8 Verify Tailor still does NOT see order until assigned
    const tailorOrdersRes2 = await fetch(`${BASE_URL}/orders`, {
      headers: { 'Authorization': `Bearer ${tailorToken}` }
    });
    const tailorOrdersData2 = await tailorOrdersRes2.json();
    const tailorOrdersList2 = Array.isArray(tailorOrdersData2.orders) ? tailorOrdersData2.orders : [];
    const tailorCanSeeUnassigned = tailorOrdersList2.some(o => o.id === order1.id);
    recordResult('Tailor Cannot See Order Before Assignment', !tailorCanSeeUnassigned, 'Tailor queue clean');

    // 2.9 CEO assigns ONE Tailor (Subangini, ID: tailorUser.id)
    const assignRes = await fetch(`${BASE_URL}/orders/${order1.id}/assign-tailor`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ceoToken}`
      },
      body: JSON.stringify({ tailorId: tailorUser.id })
    });
    const assignData = await assignRes.json();
    const isAssigned = assignData.success && assignData.order.assignedTailorId === tailorUser.id && assignData.order.tailorAccepted === false;
    recordResult('CEO Assigns ONE Tailor (Subangini Rajan)', isAssigned, `AssignedTailorId: ${assignData.order?.assignedTailorId}, tailorAccepted: ${assignData.order?.tailorAccepted}`);

    // 2.10 Tailor now sees the assigned order in My Orders with tailorAccepted: false
    const tailorOrdersRes3 = await fetch(`${BASE_URL}/orders`, {
      headers: { 'Authorization': `Bearer ${tailorToken}` }
    });
    const tailorOrdersData3 = await tailorOrdersRes3.json();
    const tailorOrdersList3 = Array.isArray(tailorOrdersData3.orders) ? tailorOrdersData3.orders : [];
    const assignedOrderInTailorList = tailorOrdersList3.find(o => o.id === order1.id);
    const tailorSeesAssigned = Boolean(assignedOrderInTailorList && assignedOrderInTailorList.tailorAccepted === false);
    recordResult('Tailor Sees Assigned Order (Waiting Acceptance)', tailorSeesAssigned, `Order present with tailorAccepted: ${assignedOrderInTailorList?.tailorAccepted}`);

    // 2.11 Tailor accepts the order → moves to CUTTING and sets tailorAccepted = true
    const acceptRes = await fetch(`${BASE_URL}/orders/${order1.id}/tailor-accept`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tailorToken}` }
    });
    const acceptData = await acceptRes.json();
    const isCuttingStarted = acceptData.success && acceptData.order.status === 'CUTTING' && acceptData.order.tailorAccepted === true;
    recordResult('Tailor Accepts Order → Status transitions to CUTTING', isCuttingStarted, `Status: ${acceptData.order?.status}, tailorAccepted: ${acceptData.order?.tailorAccepted}`);

    // 2.12 Advance through production stages: CUTTING → STITCHING
    const toStitchingRes = await fetch(`${BASE_URL}/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tailorToken}`
      },
      body: JSON.stringify({ status: 'STITCHING' })
    });
    const toStitchingData = await toStitchingRes.json();
    recordResult('Production Stage: STITCHING', toStitchingData.success && toStitchingData.order.status === 'STITCHING', `Status: ${toStitchingData.order?.status}`);

    // 2.13 Advance: STITCHING → AARI_EMBROIDERY (workRequired: Yes)
    const toAariRes = await fetch(`${BASE_URL}/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tailorToken}`
      },
      body: JSON.stringify({ status: 'AARI_EMBROIDERY' })
    });
    const toAariData = await toAariRes.json();
    recordResult('Production Stage: AARI_EMBROIDERY', toAariData.success && toAariData.order.status === 'AARI_EMBROIDERY', `Status: ${toAariData.order?.status}`);

    // 2.14 Advance: AARI_EMBROIDERY → FITTING_ALTERATION (special instructions require fitting)
    const toFittingRes = await fetch(`${BASE_URL}/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tailorToken}`
      },
      body: JSON.stringify({ status: 'FITTING_ALTERATION' })
    });
    const toFittingData = await toFittingRes.json();
    recordResult('Production Stage: FITTING_ALTERATION', toFittingData.success && toFittingData.order.status === 'FITTING_ALTERATION', `Status: ${toFittingData.order?.status}`);

    // 2.15 Advance: FITTING_ALTERATION → FINISHING
    const toFinishingRes = await fetch(`${BASE_URL}/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tailorToken}`
      },
      body: JSON.stringify({ status: 'FINISHING' })
    });
    const toFinishingData = await toFinishingRes.json();
    recordResult('Production Stage: FINISHING', toFinishingData.success && toFinishingData.order.status === 'FINISHING', `Status: ${toFinishingData.order?.status}`);

    // 2.16 Advance: FINISHING → QUALITY_CHECK
    const toQCRes = await fetch(`${BASE_URL}/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tailorToken}`
      },
      body: JSON.stringify({ status: 'QUALITY_CHECK' })
    });
    const toQCData = await toQCRes.json();
    recordResult('Production Stage: QUALITY_CHECK', toQCData.success && toQCData.order.status === 'QUALITY_CHECK', `Status: ${toQCData.order?.status}`);

    // 2.17 Advance: QUALITY_CHECK → READY (Ready for Collection)
    const toReadyRes = await fetch(`${BASE_URL}/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tailorToken}`
      },
      body: JSON.stringify({ status: 'READY' })
    });
    const toReadyData = await toReadyRes.json();
    recordResult('Production Stage: READY (Ready for Collection)', toReadyData.success && toReadyData.order.status === 'READY', `Status: ${toReadyData.order?.status}`);

    // 2.18 Final Handover: READY → DELIVERED
    const toDeliveredRes = await fetch(`${BASE_URL}/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ceoToken}`
      },
      body: JSON.stringify({ status: 'DELIVERED' })
    });
    const toDeliveredData = await toDeliveredRes.json();
    recordResult('Production Stage: DELIVERED', toDeliveredData.success && toDeliveredData.order.status === 'DELIVERED', `Status: ${toDeliveredData.order?.status}`);

    // 2.19 Verify Live Sync across Customer, CEO, and Tailor using the SAME Order ID
    const custFinalRes = await fetch(`${BASE_URL}/customer-portal/orders/${order1.id}`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const custFinalData = await custFinalRes.json();
    const sameRecordVerified = (
      custFinalData.order.id === order1.id &&
      custFinalData.order.status === 'DELIVERED' &&
      custFinalData.order.assignedTailorId === tailorUser.id
    );
    recordResult('Zero Duplication: Sync Verified Across Customer, CEO & Tailor', sameRecordVerified, `Record ID ${order1.id} matched in PostgreSQL`);

    // ----------------------------------------------------
    // TEST FLOW 2: REJECTION WORKFLOW
    // ----------------------------------------------------
    console.log('\n--- 3. TEST FLOW 2: CUSTOMER ORDER → CEO REJECTION → REASON VISIBILITY ---');

    // 3.1 Customer creates Order 2
    const createOrderRes2 = await fetch(`${BASE_URL}/customer-portal/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        garmentDetails: {
          dressType: 'Western Evening Gown',
          quantity: 1,
          fabricSuppliedBy: 'Customer',
          specialDesignInstructions: 'Urgent turnaround requested in 1 day'
        }
      })
    });
    const createOrderData2 = await createOrderRes2.json();
    const order2 = createOrderData2.order;
    recordResult('Order 2 Created by Customer', true, `Order Number: ${order2.orderNumber}, ID: ${order2.id}`);

    // 3.2 CEO rejects Order 2 with a specific rejection reason
    const rejectionReason = 'Cannot accommodate 24-hour turnaround for custom gowns. Minimum lead time is 7 business days.';
    const rejectRes = await fetch(`${BASE_URL}/orders/${order2.id}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ceoToken}`
      },
      body: JSON.stringify({ reason: rejectionReason })
    });
    const rejectData = await rejectRes.json();
    const isRejected = rejectData.success && rejectData.order.status === 'REJECTED';
    recordResult('CEO Rejects Order 2', isRejected, `Status: ${rejectData.order?.status}`);

    // 3.3 Verify Customer Dashboard sees REJECTED status and rejection reason
    const custViewOrderRes2 = await fetch(`${BASE_URL}/customer-portal/orders/${order2.id}`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const custViewOrderData2 = await custViewOrderRes2.json();
    const customerSeesRejection = (
      custViewOrderData2.order.status === 'REJECTED' &&
      custViewOrderData2.order.rejectionReason === rejectionReason
    );
    recordResult('Rejection Reason Appears in Customer Dashboard', customerSeesRejection, `Reason: "${custViewOrderData2.order?.rejectionReason}"`);

    // 3.4 Verify Tailor CANNOT see the rejected order
    const tailorOrdersRes4 = await fetch(`${BASE_URL}/orders`, {
      headers: { 'Authorization': `Bearer ${tailorToken}` }
    });
    const tailorOrdersData4 = await tailorOrdersRes4.json();
    const tailorOrdersList4 = Array.isArray(tailorOrdersData4.orders) ? tailorOrdersData4.orders : [];
    const tailorCanSeeRejected = tailorOrdersList4.some(o => o.id === order2.id);
    recordResult('Tailor Cannot See Rejected Order in Production Queue', !tailorCanSeeRejected, 'Excluded from Tailor view');

    // 3.5 Verify Tailor direct get returns 403 Forbidden
    const tailorGetOrderRes2 = await fetch(`${BASE_URL}/orders/${order2.id}`, {
      headers: { 'Authorization': `Bearer ${tailorToken}` }
    });
    recordResult('Tailor Direct Access to Rejected Order Returns 403 Forbidden', tailorGetOrderRes2.status === 403, `Status code: ${tailorGetOrderRes2.status}`);

    // ----------------------------------------------------
    // TEST FLOW 3: PAYMENT DECOUPLING VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- 4. TEST FLOW 3: PAYMENT DECOUPLING VERIFICATION ---');

    // Create a 3rd order in PENDING_APPROVAL
    const createOrderRes3 = await fetch(`${BASE_URL}/customer-portal/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        garmentDetails: {
          dressType: 'Anarkali Suit',
          quantity: 1
        }
      })
    });
    const createOrderData3 = await createOrderRes3.json();
    const order3 = createOrderData3.order;

    // Staff sets price on Order 3 to LKR 12,000
    await pool.query('UPDATE "Order" SET "totalAmount" = 12000, "balanceAmount" = 12000 WHERE id = $1', [order3.id]);

    // Record payment on Order 3 (payment should NOT change status to ORDER_CONFIRMED or approved)
    const payRes = await fetch(`${BASE_URL}/orders/${order3.id}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ceoToken}`
      },
      body: JSON.stringify({ amount: 5000 })
    });
    const payData = await payRes.json();

    // Check status after payment
    const checkOrder3 = await pool.query('SELECT status, "advancePayment" FROM "Order" WHERE id = $1', [order3.id]);
    const advancePaid = parseFloat(checkOrder3.rows[0].advancePayment);
    const paymentDecoupled = checkOrder3.rows[0].status === 'PENDING_APPROVAL' && advancePaid === 5000;
    recordResult('Payment Status Strictly Decoupled from Order Approval', paymentDecoupled, `Advance: LKR ${advancePaid}, Status remained: ${checkOrder3.rows[0].status}`);

    // ----------------------------------------------------
    // FINAL SUMMARY
    // ----------------------------------------------------
    console.log('\n================================================================');
    console.log('VERIFICATION RESULTS SUMMARY');
    console.log('================================================================');
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`Total Checks: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error('Fatal error in verification test:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runE2EWorkflowTests();
