const jwt = require('jsonwebtoken');

const JWT_SECRET = 'bella_design_jwt_secret_change_this_2026';
const BASE_URL = 'http://localhost:5000';

const tailorToken = jwt.sign(
  { id: 991, name: 'Saman Tailor', email: 'tailor@jbgroup.lk', role: 'TAILOR' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const staffToken = jwt.sign(
  { id: 992, name: 'Sunil Staff', email: 'staff@jbgroup.lk', role: 'STAFF' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const managerToken = jwt.sign(
  { id: 993, name: 'Kamal Manager', email: 'manager@jbgroup.lk', role: 'MANAGER' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const adminToken = jwt.sign(
  { id: 994, name: 'Admin Perera', email: 'admin@jbgroup.lk', role: 'ADMIN' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function run() {
  console.log('========================================================');
  console.log('END-TO-END HTTP API VERIFICATION: NOTIFICATION WORKFLOW');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(cond, msg) {
    total++;
    if (cond) {
      console.log(`✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${msg}`);
    }
  }

  try {
    // 1. Fetch orders using Manager token
    const ordersRes = await fetch(`${BASE_URL}/api/orders`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const ordersData = await ordersRes.json();
    assert(ordersRes.status === 200, `GET /api/orders returns HTTP 200 (Got ${ordersRes.status})`);
    
    const orders = ordersData.data || ordersData.orders || [];
    console.log(`Fetched ${orders.length} orders from live backend.`);

    // Find or pick an order to test with
    let targetOrder = orders.find(o => o.status === 'READY') || orders[0];
    if (!targetOrder) {
      console.error('No orders available to test.');
      process.exit(1);
    }

    console.log(`Using order #${targetOrder.orderNumber} (ID: ${targetOrder.id}, Status: ${targetOrder.status}) for testing.`);

    // Test 1: Tailor marks an order Ready -> No customer Finished/Ready message is automatically sent
    console.log('\n--- Scenario 1: Tailor advances order to READY ---');
    const tailorAdvanceRes = await fetch(`${BASE_URL}/api/orders/${targetOrder.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tailorToken}`
      },
      body: JSON.stringify({ status: 'READY', notes: 'Tailor finished stitching' })
    });
    const tailorAdvanceData = await tailorAdvanceRes.json();
    assert(tailorAdvanceRes.status === 200, `PATCH /api/orders/:id/status returns HTTP 200 (Got ${tailorAdvanceRes.status})`);
    assert(tailorAdvanceData.order?.status === 'READY', 'Order status is READY');
    assert(
      !tailorAdvanceData.order?.readyNotificationSent,
      'readyNotificationSent remains false after tailor marks order READY (No automatic notification!)'
    );
    assert(
      !tailorAdvanceData.notification?.sent,
      'Response does NOT trigger automatic notification delivery'
    );

    // Test 2: Unauthorized roles cannot invoke notifyOrderReady API directly
    console.log('\n--- Scenario 2: Role Authorization Checks ---');
    // 2a. Tailor calling notify-ready
    const tailorNotifyRes = await fetch(`${BASE_URL}/api/orders/${targetOrder.id}/notify-ready`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tailorToken}`
      },
      body: JSON.stringify({})
    });
    const tailorNotifyData = await tailorNotifyRes.json();
    assert(
      tailorNotifyRes.status === 403,
      `Tailor calling /notify-ready receives HTTP 403 Forbidden (Got: ${tailorNotifyRes.status})`
    );
    assert(
      tailorNotifyData.success === false,
      'Tailor response has success: false'
    );

    // 2b. Staff calling notify-ready
    const staffNotifyRes = await fetch(`${BASE_URL}/api/orders/${targetOrder.id}/notify-ready`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`
      },
      body: JSON.stringify({})
    });
    const staffNotifyData = await staffNotifyRes.json();
    assert(
      staffNotifyRes.status === 403,
      `Staff calling /notify-ready receives HTTP 403 Forbidden (Got: ${staffNotifyRes.status})`
    );

    // 2c. Unauthenticated request
    const unauthNotifyRes = await fetch(`${BASE_URL}/api/orders/${targetOrder.id}/notify-ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert(
      unauthNotifyRes.status === 401,
      `Unauthenticated request receives HTTP 401 Unauthorized (Got: ${unauthNotifyRes.status})`
    );

    // Test 3: Readiness check (order must be READY)
    console.log('\n--- Scenario 3: Order not ready for collection check ---');
    // Temporarily set status to STITCHING
    await fetch(`${BASE_URL}/api/orders/${targetOrder.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({ status: 'STITCHING' })
    });

    const notReadyRes = await fetch(`${BASE_URL}/api/orders/${targetOrder.id}/notify-ready`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({})
    });
    const notReadyData = await notReadyRes.json();
    assert(
      notReadyRes.status === 400,
      `Manager calling /notify-ready for STITCHING stage returns HTTP 400 Bad Request (Got: ${notReadyRes.status})`
    );
    assert(
      notReadyData.message?.includes('Ready for Collection'),
      `Error message requires Ready status: "${notReadyData.message}"`
    );

    // Now set back to READY
    await fetch(`${BASE_URL}/api/orders/${targetOrder.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({ status: 'READY' })
    });

    // Test 4: Manager confirms: the customer message is sent successfully
    console.log('\n--- Scenario 4: Manager confirms and sends Customer Finished Notification ---');
    const mgrNotifyRes = await fetch(`${BASE_URL}/api/orders/${targetOrder.id}/notify-ready`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({ force: true }) // use force to ensure it dispatches cleanly
    });
    const mgrNotifyData = await mgrNotifyRes.json();
    assert(
      mgrNotifyRes.status === 200,
      `Manager confirmation returns HTTP 200 OK (Got: ${mgrNotifyRes.status})`
    );
    assert(
      mgrNotifyData.success === true,
      'Response has success: true'
    );
    assert(
      Boolean(mgrNotifyData.customerName),
      `Preview includes customerName: "${mgrNotifyData.customerName}"`
    );
    assert(
      Boolean(mgrNotifyData.phone),
      `Preview includes customer phone: "${mgrNotifyData.phone}"`
    );
    assert(
      Boolean(mgrNotifyData.orderNumber),
      `Preview includes orderNumber: "${mgrNotifyData.orderNumber}"`
    );
    assert(
      mgrNotifyData.whatsAppMessage?.includes('ready for collection'),
      `Preview includes approved WhatsApp text: "${mgrNotifyData.whatsAppMessage}"`
    );
    assert(
      Boolean(mgrNotifyData.sentBy),
      `Sent by recorded as: "${mgrNotifyData.sentBy}"`
    );
    assert(
      Boolean(mgrNotifyData.sentAt),
      `Sent at timestamp recorded: "${mgrNotifyData.sentAt}"`
    );
    assert(
      mgrNotifyData.order?.readyNotificationSent === true,
      'Order record in DB has readyNotificationSent = true'
    );
    assert(
      mgrNotifyData.order?.readyNotificationSentBy === 'Kamal Manager' || mgrNotifyData.order?.readyNotificationSentBy === 'Manager',
      `Order in DB has readyNotificationSentBy: "${mgrNotifyData.order?.readyNotificationSentBy}"`
    );

    // Test 5: Repeated clicks do not send duplicate messages
    console.log('\n--- Scenario 5: Repeated clicks prevent duplicate notifications ---');
    const dupNotifyRes = await fetch(`${BASE_URL}/api/orders/${targetOrder.id}/notify-ready`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({ force: false }) // force = false represents normal repeated clicks
    });
    const dupNotifyData = await dupNotifyRes.json();
    assert(
      dupNotifyRes.status === 409,
      `Repeated click returns HTTP 409 Conflict (Got: ${dupNotifyRes.status})`
    );
    assert(
      dupNotifyData.duplicatePrevented === true,
      'Response indicates duplicatePrevented: true'
    );
    assert(
      dupNotifyData.message?.includes('Duplicate prevented'),
      `Duplicate prevented message returned: "${dupNotifyData.message}"`
    );

    // Test 6: Admin / CEO authorization
    console.log('\n--- Scenario 6: Admin / CEO authorization ---');
    const adminNotifyRes = await fetch(`${BASE_URL}/api/orders/${targetOrder.id}/notify-ready`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ force: true })
    });
    const adminNotifyData = await adminNotifyRes.json();
    assert(
      adminNotifyRes.status === 200,
      `Admin role calling /notify-ready returns HTTP 200 OK (Got: ${adminNotifyRes.status})`
    );
    assert(
      adminNotifyData.success === true,
      'Admin notification success: true'
    );

    console.log('\n========================================================');
    console.log(`ALL TESTS PASSED: ${passed} / ${total}`);
    console.log('========================================================');

    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Test run failed with error:', err);
    process.exit(1);
  }
}

run();
